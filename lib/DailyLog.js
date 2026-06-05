// CustomJS shared library for daily-note logging scripts.
// Access from QuickAdd UserScripts via: const { DailyLog } = window.customJS;
// Register: CustomJS settings → Folder = "Helper/lib"
class DailyLog {
    // Local-timezone YYYY-MM-DD
    formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // Today's daily-note path: 日记/<year>/<YYYY-MM-DD>.md
    todayDailyPath() {
        const d = new Date();
        return `日记/${d.getFullYear()}/${this.formatDate(d)}.md`;
    }

    // status normalizer: handles both array and scalar frontmatter values
    fmHasValue(fm, key, val) {
        const x = fm?.[key];
        return Array.isArray(x) ? x.includes(val) : x === val;
    }

    // Resolve which note to log into: the active file if it's a daily note
    // (日记/…/YYYY-MM-DD.md), otherwise today's daily note.
    // Returns a TFile, or null if the fallback (today's note) doesn't exist.
    resolveDailyTarget(app) {
        const active = app.workspace.getActiveFile();
        if (active && active.path.startsWith("日记/") && /^\d{4}-\d{2}-\d{2}$/.test(active.basename)) {
            return active;
        }
        return app.vault.getAbstractFileByPath(this.todayDailyPath());
    }

    // Upsert "- [[selected]] prop:: value" inside the "## …keyword" section of `file`.
    // Section ends at next === (columns separator), closing ```, or any # / ## heading.
    // Returns 'updated' | 'added' | 'no-section'.
    async sectionUpsert(app, file, keyword, prop, selected, value) {
        const lines = (await app.vault.read(file)).split("\n");

        // Find "## …keyword" via hardcoded regex + substring (no dynamic RegExp).
        let start = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^##\s/.test(lines[i]) && lines[i].includes(keyword)) { start = i; break; }
        }
        if (start === -1) return "no-section";

        let end = lines.length;
        for (let j = start + 1; j < lines.length; j++) {
            const t = lines[j].trim();
            if (t === "===" || t === "```" || /^#{1,2} /.test(lines[j])) { end = j; break; }
        }

        const entry = `- [[${selected}]] ${prop}:: ${value}`;
        const search = `- [[${selected}]] ${prop}:: `;
        for (let k = start + 1; k < end; k++) {
            if (lines[k].startsWith(search)) {
                lines[k] = entry;
                await app.vault.modify(file, lines.join("\n"));
                return "updated";
            }
        }
        lines.splice(end, 0, entry);
        await app.vault.modify(file, lines.join("\n"));
        return "added";
    }
}
