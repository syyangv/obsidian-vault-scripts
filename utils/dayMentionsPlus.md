---
modified_at: 2026-05-18
---

```dataviewjs
(async () => {
    // ── 1. Guard: daily note only ────────────────────────────────────────────
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return;

    const dateMatch = activeFile.basename.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return;

    const targetDate = activeFile.basename;   // YYYY-MM-DD
    const targetPath = activeFile.path;
    const targetYear = dateMatch[1];
    const targetMD   = `${dateMatch[2]}-${dateMatch[3]}`;   // MM-DD for registry

    const helperPath    = dv.current()?.file?.path;
    const cacheKey      = `dayMentions_${targetPath}`;
    const cacheVersion  = '17';

    // ── 2. Embed visibility helpers ──────────────────────────────────────────
    // Unique style ID avoids conflict with cached dayMentions style in the DOM.
    function ensureHideStyle() {
        const styleId = 'dayMentionsPlus-hide-style';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .markdown-embed:has(.dmp-empty),
            .internal-embed:has(.dmp-empty) {
                display: none !important; height: 0 !important; min-height: 0 !important;
                margin: 0 !important; padding: 0 !important; border: 0 !important;
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(style);
    }

    function setEmbedVisible(visible) {
        ensureHideStyle();
        dv.container.querySelectorAll('.dmp-empty').forEach(el => el.remove());
        if (!visible) {
            dv.container.createSpan({ cls: 'dmp-empty', attr: { style: 'display:none;' } });
        }
        // Hide dv.container itself AND walk up to the embed wrapper.
        // Using setProperty with !important to beat Obsidian's own CSS.
        const apply = () => {
            const v = visible ? '' : 'none';
            const z = visible ? '' : '0';
            // Hide the dataviewjs block container
            dv.container.style.setProperty('display',    v, 'important');
            dv.container.style.setProperty('height',     z, 'important');
            dv.container.style.setProperty('min-height', z, 'important');
            dv.container.style.setProperty('overflow', visible ? '' : 'hidden', 'important');
            // Walk up to embed frame and hide it too
            let el = dv.container.parentElement;
            while (el && el !== document.body) {
                const cls = el.classList;
                if (cls.contains('internal-embed') || cls.contains('markdown-embed')) {
                    el.style.setProperty('display',    v, 'important');
                    el.style.setProperty('height',     z, 'important');
                    el.style.setProperty('min-height', z, 'important');
                    el.style.setProperty('margin',     z, 'important');
                    el.style.setProperty('padding',    z, 'important');
                    el.style.setProperty('border',  visible ? '' : 'none', 'important');
                    el.style.setProperty('overflow', visible ? '' : 'hidden', 'important');
                    break;
                }
                if (cls.contains('markdown-embed-content') ||
                    cls.contains('markdown-preview-view')  ||
                    cls.contains('markdown-preview-sizer')) {
                    el.style.setProperty('background', 'transparent', 'important');
                    el.style.setProperty('padding',    '0',           'important');
                }
                el = el.parentElement;
            }
        };
        apply();
        requestAnimationFrame(apply);
        setTimeout(apply, 100);
        setTimeout(apply, 400);  // extra retry for slow Obsidian renders
    }

    function clearEmbedBg() {
        let el = dv.container.parentElement;
        while (el && el !== document.body) {
            const cls = el.classList;
            if (cls.contains('internal-embed') || cls.contains('markdown-embed')) {
                el.style.setProperty('background', 'transparent', 'important');
                el.style.setProperty('border',     'none',        'important');
                el.style.setProperty('box-shadow', 'none',        'important');
                el.style.setProperty('padding',    '0',           'important');
                el.style.setProperty('margin',     '0',           'important');
                el.style.setProperty('max-height', 'none',        'important');
                // Also hide the embed link icon that Obsidian appends
                el.querySelector('.markdown-embed-link')
                  ?.style.setProperty('display', 'none', 'important');
                break;
            }
            if (cls.contains('markdown-embed-content') ||
                cls.contains('markdown-preview-view')  ||
                cls.contains('markdown-preview-sizer')) {
                el.style.setProperty('background', 'transparent', 'important');
                el.style.setProperty('padding',    '0',           'important');
                el.style.setProperty('margin',     '0',           'important');
                el.style.setProperty('max-height', 'none',        'important');
            }
            el = el.parentElement;
        }
    }

    // ── 3. Fetch mentions (dayMentions logic) ────────────────────────────────
    function isDailyOrMonthly(file) {
        const path = file.path, basename = file.basename;
        if (path.startsWith('日记/')) return true;
        if (path.includes('/月计划/')) return true;
        if (path.startsWith('Helper/')) return true;
        if (path.startsWith('流程说明/') || path.includes('/流程说明/')) return true;
        if (/^\d{4}-\d{2}-\d{2}$/.test(basename)) return true;
        if (/^\d{4}-\d{2}$/.test(basename)) return true;
        return false;
    }

    function isWeeklyNote(file) {
        return file.path.startsWith('周计划/') || /^\d{4}-W\d{2}$/.test(file.basename);
    }

    function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function snippetAround(content, index, length) {
        const start   = Math.max(0, index - 25);
        const end     = Math.min(content.length, index + length + 45);
        const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
        return snippet.length > 90 ? `${snippet.slice(0, 87)}…` : snippet;
    }

    function isTaskLine(line) { return /^\s*[-*+]\s+\[[^\]]\]\s+/.test(line); }

    function frontmatterEndOffset(content) {
        if (!content.startsWith('---\n')) return 0;
        const end = content.indexOf('\n---', 4);
        return end === -1 ? 0 : end + 4;
    }

    const linkTargets   = [targetDate, `${targetDate}.md`, targetPath,
                           targetPath.replace(/\.md$/, ''),
                           `日记/${targetYear}/${targetDate}`,
                           `日记/${targetYear}/${targetDate}.md`];
    const linkPattern   = new RegExp(`\\[\\[\\s*(?:${linkTargets.map(escapeRegex).join('|')})(?:#[^\\]|]*)?(?:\\|[^\\]]*)?\\s*\\]\\]`, 'i');
    const plainDatePat  = new RegExp(`(^|[^0-9])${escapeRegex(targetDate)}([^0-9]|$)`);

    function frontmatterLabelForMention(content) {
        if (!content.startsWith('---\n')) return null;
        const end = content.indexOf('\n---', 4);
        if (end === -1) return null;
        const fm = content.slice(4, end);
        let currentLabel = null;
        for (const line of fm.split(/\n/)) {
            const keyMatch = line.match(/^([A-Za-z0-9_\-一-鿿 ]+)\s*:\s*(.*)$/);
            if (keyMatch) currentLabel = keyMatch[1].trim();
            if ((linkPattern.test(line) || plainDatePat.test(line)) && currentLabel) {
                if (['modified_at','last_commit','auto_updated'].includes(currentLabel)) continue;
                return keyMatch ? `${currentLabel}: ${keyMatch[2].trim()}` :
                                  `${currentLabel}: ${line.trim().replace(/^\s*-\s*/, '')}`;
            }
        }
        return null;
    }

    function findNonTaskMention(content, file) {
        const weekly = isWeeklyNote(file);
        const fmLabel = weekly ? null : frontmatterLabelForMention(content);
        if (fmLabel) return { reason: 'frontmatter', label: fmLabel };

        const searchOffset = frontmatterEndOffset(content);
        let offset = searchOffset, fenceDepth = 0;
        for (const line of content.slice(searchOffset).split(/\n/)) {
            if (weekly) {
                const trimmed = line.trim();
                if (fenceDepth === 0) {
                    const om = trimmed.match(/^(`{3,})/);
                    if (om) fenceDepth = om[1].length;
                } else {
                    const cm = trimmed.match(/^(`+)\s*$/);
                    if (cm && cm[1].length >= fenceDepth) fenceDepth = 0;
                }
            }
            if (fenceDepth === 0 && !isTaskLine(line)) {
                const lm = line.match(linkPattern);
                if (lm) return { reason: 'linked', index: offset + (lm.index ?? 0), length: lm[0].length };
                const dm = line.match(plainDatePat);
                if (dm) return { reason: 'text',   index: offset + (dm.index ?? 0), length: dm[0].length };
            }
            offset += line.length + 1;
        }
        return null;
    }

    async function fetchMentions() {
        if (window[cacheKey] &&
            window[cacheKey].version === cacheVersion &&
            window[cacheKey].timestamp > Date.now() - 60000) {
            return window[cacheKey].data;
        }
        const results = [];
        for (const file of app.vault.getMarkdownFiles()) {
            if (file.path === targetPath) continue;
            if (helperPath && file.path === helperPath) continue;
            if (isDailyOrMonthly(file)) continue;
            let content = '';
            try { content = await app.vault.cachedRead(file); }
            catch (e) { console.warn(`dayMentionsPlus: failed to read ${file.path}`, e); continue; }
            const mention = findNonTaskMention(content, file);
            if (!mention) continue;
            results.push({
                file, reason: mention.reason,
                snippet: mention.label || snippetAround(content, mention.index, mention.length)
            });
        }
        results.sort((a, b) => a.file.basename.localeCompare(b.file.basename));
        window[cacheKey] = { version: cacheVersion, timestamp: Date.now(), data: results };
        return results;
    }

    // ── 4. Fetch important dates (importantDates logic) ──────────────────────
    async function fetchDates() {
        const registryFile = app.vault.getAbstractFileByPath('个人整理/重要日期.md');
        if (!registryFile) return [];
        const content = await app.vault.read(registryFile);
        return content
            .split('\n')
            .filter(line => {
                const t = line.trim();
                return t.startsWith('|') && !t.startsWith('|--') && !/^\|\s*date\s*\|/i.test(t);
            })
            .map(line => {
                const cells = line.split('|').map(c => c.trim()).filter(c => c);
                return { date: cells[0], label: cells[1], type: cells[2] };
            })
            .filter(e => e.date && e.label && e.type && e.date === targetMD);
    }

    // ── 5. Run both fetches concurrently ─────────────────────────────────────
    const [mentions, dateEvents] = await Promise.all([fetchMentions(), fetchDates()]);

    if (!mentions.length && !dateEvents.length) { setEmbedVisible(false); return; }

    setEmbedVisible(true);
    clearEmbedBg();
    setTimeout(clearEmbedBg, 150);
    setTimeout(clearEmbedBg, 500);
    setTimeout(clearEmbedBg, 1200);

    // ── 6. Render wrapper ────────────────────────────────────────────────────
    const wrapper = dv.container.createEl('div', { cls: 'id-wrapper' });

    // ── 7. Mentions panel (dm-* classes, styled in theme.css) ────────────────
    if (mentions.length) {
        const card  = wrapper.createEl('div', { cls: 'dm-card' });
        const strip = card.createEl('div', { cls: 'dm-strip' });
        strip.createEl('span', { cls: 'dm-timestamp', text: 'Mentioned in' });

        const body    = card.createEl('div', { cls: 'dm-body' });
        const hdr     = body.createEl('div', { cls: 'dm-hdr' });
        const iconBox = hdr.createEl('div', { cls: 'dm-icon-box' });
        iconBox.innerHTML = `<svg viewBox="0 0 56 56" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 18 H12 A10 10 0 0 0 12 38 H22 A10 10 0 0 0 22 18 Z" fill="#8444c0" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M34 18 H44 A10 10 0 0 1 44 38 H34 A10 10 0 0 1 34 18 Z" fill="#b070e0" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
            <rect x="20" y="24" width="16" height="8" rx="3" fill="white" opacity="0.9"/>
            <ellipse cx="15" cy="28" rx="4" ry="5" fill="white" opacity="0.4"/>
            <ellipse cx="41" cy="28" rx="4" ry="5" fill="white" opacity="0.4"/>
        </svg>`;

        const titleBlock = hdr.createEl('div');
        titleBlock.createEl('div', { cls: 'dm-title', text: 'Mentioned In' });
        titleBlock.createEl('div', {
            cls: 'dm-count',
            text: `${mentions.length} note${mentions.length !== 1 ? 's' : ''} reference this day`
        });

        const itemsEl = body.createEl('div', { cls: 'dm-items' });
        for (const item of mentions) {
            const itemEl = itemsEl.createEl('div', { cls: 'dm-item', attr: { 'data-r': item.reason } });
            itemEl.createEl('span', { cls: 'dm-dot' });
            const link = itemEl.createEl('a', {
                cls: 'dm-name', text: item.file.basename, attr: { href: item.file.path }
            });
            link.addEventListener('click', e => {
                e.preventDefault();
                app.workspace.openLinkText(item.file.path.replace(/\.md$/, ''), activeFile.path);
            });
            itemEl.createEl('span', { cls: 'dm-folder', text: item.file.parent?.path || '/' });
            if (item.snippet) itemEl.createEl('span', { cls: 'dm-snip', text: item.snippet });
        }
    }

    // ── 8. Important dates panel (id-* classes, styled in theme.css) ─────────
    if (dateEvents.length) {
        const ICON_SVGS = {
            birthday: `<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="8" width="12" height="6" rx="1.5"/>
                <path d="M2 11h12M5.5 8V6.5M8 8V6M10.5 8V6.5"/>
                <path d="M5.5 6.5C5.5 5.5 4.5 5 5.5 4C6.5 5 5.5 5.5 5.5 6.5" fill="white" stroke="none"/>
                <path d="M8 6C8 5 7 4.5 8 3.5C9 4.5 8 5 8 6" fill="white" stroke="none"/>
                <path d="M10.5 6.5C10.5 5.5 9.5 5 10.5 4C11.5 5 10.5 5.5 10.5 6.5" fill="white" stroke="none"/>
            </svg>`,
            anniversary: `<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
                <circle cx="5.5" cy="8" r="3.2"/>
                <circle cx="10.5" cy="8" r="3.2"/>
            </svg>`,
            holiday: `<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="12" height="10" rx="1.5"/>
                <path d="M2 7h12M5.5 2v3M10.5 2v3"/>
                <path d="M8 9.5l.55 1.2 1.3.1-.95.9.28 1.3L8 12.3l-1.18.7.28-1.3-.95-.9 1.3-.1z" fill="white" stroke="none"/>
            </svg>`,
        };
        const TYPE_LABELS = { birthday: '生日', anniversary: '纪念日', holiday: '节日' };

        const card  = wrapper.createEl('div', { cls: 'id-card' });
        const strip = card.createEl('div', { cls: 'id-strip' });
        strip.createEl('span', { cls: 'id-timestamp', text: '今日重要日期' });

        const body    = card.createEl('div', { cls: 'id-body' });
        const hdr     = body.createEl('div', { cls: 'id-hdr' });
        const iconBox = hdr.createEl('div', { cls: 'id-icon-box' });
        iconBox.innerHTML = `<svg viewBox="0 0 36 36" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="8" width="30" height="23" rx="3" fill="#5aaee0" opacity=".3"/>
            <rect x="3" y="8" width="30" height="23" rx="3" fill="none" stroke="#1a1208" stroke-width="1.5"/>
            <rect x="3" y="8" width="30" height="8" rx="3" fill="#1a1208" opacity=".15"/>
            <rect x="3" y="12" width="30" height="4" fill="#1a1208" opacity=".15"/>
            <line x1="11" y1="5" x2="11" y2="13" stroke="#1a1208" stroke-width="2" stroke-linecap="round"/>
            <line x1="25" y1="5" x2="25" y2="13" stroke="#1a1208" stroke-width="2" stroke-linecap="round"/>
            <path d="M15.5 19.5 L18 14.5 L20.5 19.5 L25.5 19.5 L21.5 23 L23 28 L18 25 L13 28 L14.5 23 L10.5 19.5 Z" fill="#50e131" stroke="white" stroke-width=".8"/>
        </svg>`;
        hdr.createEl('div', { cls: 'id-title', text: targetDate });

        const itemsEl = body.createEl('div', { cls: 'id-items' });
        for (const ev of dateEvents) {
            const item    = itemsEl.createEl('div', { cls: 'id-item', attr: { 'data-type': ev.type || 'holiday' } });
            const iconEl  = item.createEl('div', { cls: 'id-item-icon' });
            iconEl.innerHTML = ICON_SVGS[ev.type] || ICON_SVGS.holiday;
            const content = item.createEl('div', { cls: 'id-item-content' });
            content.createEl('div', { cls: 'id-item-label', text: ev.label });
            // type label hidden per user preference — kept in DOM for data-type icon coloring
        }
    }
})();
```
