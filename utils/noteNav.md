---
modified_at: 2026-07-20
---
```dataviewjs
(function () {
try {
    const helperPath = "Helper/utils/noteNav";
    const current = dv.current();
    const currentPath = current?.file?.path;
    const activePath = app.workspace.getActiveFile()?.path;
    const targetPath = currentPath && !currentPath.includes(helperPath) ? currentPath : activePath;
    if (!targetPath) return;

    const page = dv.page(targetPath);
    const file = page?.file;
    const folderPath = file?.folder || '';

    if (file) {

// Get sibling files in the same folder
const siblings = dv.pages(`"${folderPath}"`)
    .where(p => p.file.folder === folderPath)
    .sort(p => p.file.name, 'asc')
    .array();

// Find current file index
const currentIndex = siblings.findIndex(p => p.file.path === file.path);

// Get prev and next
const prev = currentIndex > 0 ? siblings[currentIndex - 1] : null;
const next = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

// Find parent folder note (traverse up)
let parentFile = null;
let searchPath = folderPath;
while (searchPath) {
    const parts = searchPath.split('/');
    const folderName = parts[parts.length - 1];
    const folderNotePath = searchPath + '/' + folderName + '.md';

    if (folderNotePath !== file.path) {
        const folderNote = dv.page(folderNotePath);
        if (folderNote) {
            parentFile = folderNote.file;
            break;
        }
    }
    parts.pop();
    searchPath = parts.join('/');
}

// Sims squircle icon helper
function simIconSpan(parent, svgPoints) {
    const icon = parent.createEl('span', {
        attr: { style: 'display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:28%;background:linear-gradient(145deg,#3aa4c2,#094a63);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.3),0 2px 4px rgba(0,0,0,.4);flex-shrink:0;' }
    });
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '13'); svg.setAttribute('height', '13');
    svg.setAttribute('viewBox', '0 0 18 18'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'white'); svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    const pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('points', svgPoints);
    svg.appendChild(pl); icon.appendChild(svg);
    return icon;
}

// Build navigation — background removed, handled by plumbob-helper-utils.css
const container = dv.el('div', '', {
    attr: { style: 'display:flex; justify-content:space-between; align-items:center; padding:6px 0; margin:8px 0; font-size:0.85em; gap:8px;' }
});

const linkStyle = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;background:transparent;color:var(--text-normal);text-decoration:none;font-weight:500;';
const centerLinkStyle = linkStyle + 'color:var(--text-accent);';

const leftDiv   = container.createDiv({ attr: { style: 'flex:1; display:flex; justify-content:flex-end;' } });
const centerDiv = container.createDiv({ attr: { style: 'flex:0 0 auto; text-align:center; margin:0 12px;' } });
const rightDiv  = container.createDiv({ attr: { style: 'flex:1; display:flex; justify-content:flex-start;' } });

if (prev) {
    const link = leftDiv.createEl('a', { cls: 'internal-link' });
    link.setAttribute('data-href', prev.file.path);
    link.setAttribute('href', prev.file.path);
    link.setAttribute('style', linkStyle);
    simIconSpan(link, '11,4 6,9 11,14');
    link.createSpan({ text: prev.file.name, attr: { style: 'max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' } });
} else {
    leftDiv.createSpan({ text: '', attr: { style: 'opacity:0;' } });
}

if (parentFile) {
    const link = centerDiv.createEl('a', { cls: 'internal-link' });
    link.setAttribute('data-href', parentFile.path);
    link.setAttribute('href', parentFile.path);
    link.setAttribute('style', centerLinkStyle);
    simIconSpan(link, '4,11 9,6 14,11');
    link.createSpan({ text: parentFile.name });
} else {
    centerDiv.createSpan({ text: '—', attr: { style: 'color:var(--text-faint);' } });
}

if (next) {
    const link = rightDiv.createEl('a', { cls: 'internal-link' });
    link.setAttribute('data-href', next.file.path);
    link.setAttribute('href', next.file.path);
    link.setAttribute('style', linkStyle);
    link.createSpan({ text: next.file.name, attr: { style: 'max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' } });
    simIconSpan(link, '7,4 12,9 7,14');
} else {
    rightDiv.createSpan({ text: '', attr: { style: 'opacity:0;' } });
}
}
} catch (error) {
    console.error("noteNav error:", error);
}
})();
```
