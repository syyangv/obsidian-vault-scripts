---
modified_at: 2026-09-03
---
```dataviewjs
(async () => {
    // ── 1. Guard: only run inside a YYYY-MM-DD daily note ──────────────
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return;

    const dateMatch = activeFile.basename.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return;

    const month = dateMatch[2];
    const day   = dateMatch[3];
    const targetDate = `${month}-${day}`;

    // ── 2. Load registry (markdown table in body) ────────────────────────
    // Registry note: 个人整理/重要日期.md — table with columns: Date | Label | Type
    const registryFile = app.vault.getAbstractFileByPath("个人整理/重要日期.md");
    if (!registryFile) return;

    const content = await app.vault.read(registryFile);

    // ── 3. Parse table rows ──────────────────────────────────────────────
    const allEvents = content
        .split('\n')
        .filter(line => {
            const trimmed = line.trim();
            // Keep only data rows: start with |, not the header or separator
            return trimmed.startsWith('|')
                && !trimmed.startsWith('|--')
                && !/^\|\s*date\s*\|/i.test(trimmed);
        })
        .map(line => {
            const cells = line.split('|').map(c => c.trim()).filter(c => c);
            return { date: cells[0], label: cells[1], type: cells[2] };
        })
        .filter(e => e.date && e.label && e.type);

    // ── 4. Filter matching events ───────────────────────────────────────
    const todayEvents = allEvents.filter(e => e.date === targetDate);
    if (todayEvents.length === 0) return;

    // ── 5. SVG icon map ─────────────────────────────────────────────────
    const icons = {
        birthday: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="8" width="12" height="6" rx="1.5"/>
            <path d="M2 11h12M5.5 8V6.5M8 8V6M10.5 8V6.5"/>
            <path d="M5.5 6.5C5.5 5.5 4.5 5 5.5 4C6.5 5 5.5 5.5 5.5 6.5" fill="currentColor" stroke="none"/>
            <path d="M8 6C8 5 7 4.5 8 3.5C9 4.5 8 5 8 6" fill="currentColor" stroke="none"/>
            <path d="M10.5 6.5C10.5 5.5 9.5 5 10.5 4C11.5 5 10.5 5.5 10.5 6.5" fill="currentColor" stroke="none"/>
        </svg>`,
        anniversary: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <circle cx="5.5" cy="8" r="3.2"/>
            <circle cx="10.5" cy="8" r="3.2"/>
        </svg>`,
        holiday: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="12" height="10" rx="1.5"/>
            <path d="M2 7h12M5.5 2v3M10.5 2v3"/>
            <path d="M8 9.5l.55 1.2 1.3.1-.95.9.28 1.3L8 12.3l-1.18.7.28-1.3-.95-.9 1.3-.1z" fill="currentColor" stroke="none"/>
        </svg>`,
    };
    const fallbackIcon = icons.holiday;

    // ── 6. Build chip HTML ───────────────────────────────────────────────
    const chipsHtml = todayEvents
        .filter(e => e.label)
        .map(e => {
            const icon  = icons[e.type] || fallbackIcon;
            const label = String(e.label)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return `<span style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 13px 4px 9px;
                border-radius: 999px;
                font-family: var(--font-ui, 'Nunito', sans-serif);
                font-size: 13px;
                font-weight: 700;
                white-space: nowrap;
                background: linear-gradient(180deg, #7fc8dc 0%, #3aa4c2 100%);
                color: #fff;
                border: none;
                box-shadow: inset 0 1px 0 rgba(255,255,255,.35);
            ">${icon}${label}</span>`;
        }).join('');

    // ── 7. Build full panel HTML ─────────────────────────────────────────
    const html = `
    <div style="
        background: linear-gradient(180deg, #bfe7f1 0%, #3aa4c2 100%);
        border: 1px solid rgba(127,200,220,.6);
        border-radius: 14px;
        box-shadow: 0 6px 14px rgba(0,0,0,.25), 0 2px 4px rgba(0,0,0,.15),
                    inset 0 1px 0 rgba(255,255,255,.6);
        padding: 11px 13px 13px;
        margin: 8px auto;
        width: fit-content;
        font-family: var(--font-ui, 'Nunito', sans-serif);
    ">
        <div style="
            font-family: var(--font-display, 'Fredoka', 'Nunito', sans-serif);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #05161f;
            display: flex;
            align-items: center;
            gap: 6px;
            padding-bottom: 8px;
            margin-bottom: 9px;
            border-bottom: 1px solid rgba(0,0,0,.12);
        ">
            📅 今日重要日期
        </div>
        <div style="
            background: #e9f1fb;
            border: 1px solid #a8c1dc;
            border-radius: 8px;
            padding: 9px 11px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        ">
            ${chipsHtml}
        </div>
    </div>`;

    // ── 8. Render ────────────────────────────────────────────────────────
    const wrapper = dv.container.createDiv();
    wrapper.innerHTML = html;
})();
```
