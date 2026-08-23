---
modified_at: 2026-07-19
---

```dataviewjs
(() => {
    const STYLE_ID = 'task-age-badge-style';
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .task-age-badge {
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
            .task-age-badge.age-green {
                color: #2f7d45 !important;
                background: #dff5e6 !important;
                border: 1px solid #9bd8aa !important;
            }
            .task-age-badge.age-yellow {
                color: #8a6a00 !important;
                background: #fff1b8 !important;
                border: 1px solid #e3c957 !important;
            }
            .task-age-badge.age-red {
                color: #9b2f2f !important;
                background: #ffd9d9 !important;
                border: 1px solid #e39a9a !important;
            }
            .task-age-badge.is-ended {
                opacity: 0.72;
            }
        `;
        document.head.appendChild(style);
    }

    function installTaskAgeBadges() {
        const today = window.moment().startOf('day');
        const activeRoot = app.workspace.activeLeaf?.view?.containerEl;
        const roots = [activeRoot, document].filter(Boolean);
        const taskEls = new Set();

        for (const root of roots) {
            root.querySelectorAll('.task-list-item').forEach(el => taskEls.add(el));
        }

        taskEls.forEach(taskEl => {
            if (taskEl.querySelector('.task-age-badge')) return;

            const text = taskEl.innerText ?? '';
            const createdMatch = text.match(/➕\s*(\d{4}-\d{2}-\d{2})/);
            if (!createdMatch) return;

            const created = window.moment(createdMatch[1], 'YYYY-MM-DD').startOf('day');
            if (!created.isValid()) return;

            const endedMatch = text.match(/[✅❌]\s*(\d{4}-\d{2}-\d{2})/);
            const ended = endedMatch ? window.moment(endedMatch[1], 'YYYY-MM-DD').startOf('day') : null;
            const end = ended?.isValid() ? ended : today;
            const days = Math.max(0, end.diff(created, 'days'));

            const ageClass = days <= 4 ? 'age-green' : days <= 7 ? 'age-yellow' : 'age-red';
            const ageColors = {
                'age-green': { color: '#2f7d45', background: '#dff5e6', border: '#9bd8aa' },
                'age-yellow': { color: '#8a6a00', background: '#fff1b8', border: '#e3c957' },
                'age-red': { color: '#9b2f2f', background: '#ffd9d9', border: '#e39a9a' }
            };

            const badge = document.createElement('span');
            badge.className = `task-age-badge ${ageClass}` + (ended ? ' is-ended' : '');
            badge.textContent = `${days}d`;
            badge.style.setProperty('color', ageColors[ageClass].color, 'important');
            badge.style.setProperty('background-color', ageColors[ageClass].background, 'important');
            badge.style.setProperty('border', `1px solid ${ageColors[ageClass].border}`, 'important');
            badge.title = ended
                ? `${days} days from created to ${text.includes('❌') ? 'cancelled' : 'completed'}`
                : `${days} days since created`;

            const checkbox = taskEl.querySelector('input.task-list-item-checkbox, input[type="checkbox"]');
            if (checkbox) checkbox.insertAdjacentElement('afterend', badge);
            else taskEl.prepend(badge);
        });
    }

    for (const delay of [0, 100, 300, 800, 1500, 3000]) {
        setTimeout(installTaskAgeBadges, delay);
    }

    const root = app.workspace.activeLeaf?.view?.containerEl;
    if (root) {
        const observer = new MutationObserver(() => {
            clearTimeout(window._taskAgeBadgeObserverTimer);
            window._taskAgeBadgeObserverTimer = setTimeout(installTaskAgeBadges, 150);
        });
        observer.observe(root, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 30000);
    }
})();
```
