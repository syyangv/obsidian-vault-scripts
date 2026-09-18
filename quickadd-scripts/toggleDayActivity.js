// QuickAdd UserScript — toggle a per-day activity section + frontmatter tag/flag.
// Replaces addSwimmingSection.js + addTherapySection.js.
// Each macro configures via command settings:
//   { sectionTitle, anchor, tagsCsv, flagKey, flagClaimSectionsCsv, tagClaimSectionsCsv }
//   - sectionTitle: heading to add/remove, e.g. "# 游泳课" / "# Therapy"
//   - anchor:       heading to insert before (default "# Event")
//   - tagsCsv:      activity_tags to add/remove, comma-separated, e.g. "健身房"
//   - flagKey:      optional bool frontmatter key (swimming uses "activity_swimming"; therapy leaves "")
//   - flagClaimSectionsCsv / tagClaimSectionsCsv: headings belonging to OTHER
//     activities that share this one's flag / tag. If any of them is present,
//     un-logging keeps that artifact — it is still claimed. `activity_pt` is
//     shared by Physical Therapy and Pilates; `健身房` by 游泳课 and Pilates.
//     Without this, removing one would silently un-log its sibling.
// NOTE: QuickAdd passes UserScript settings as the SECOND arg — fn(params, settings) — NOT params.settings.
module.exports = async (params, settings) => {
    const { app } = params;
    settings = settings || {};
    const sectionTitle = (settings.sectionTitle || "").trim();
    const anchor = (settings.anchor || "# Event").trim();
    const tags = (settings.tagsCsv || "").split(",").map(s => s.trim()).filter(Boolean);
    const flagKey = (settings.flagKey || "").trim();
    const csv = (v) => (v || "").split(",").map(s => s.trim()).filter(Boolean);
    const flagClaimSections = csv(settings.flagClaimSectionsCsv);
    const tagClaimSections = csv(settings.tagClaimSectionsCsv);

    if (!sectionTitle) { new Notice("toggleDayActivity: missing sectionTitle setting"); return; }

    const file = app.workspace.getActiveFile();
    if (!file) { new Notice("No active file"); return; }

    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const curTags = Array.isArray(fm?.activity_tags)
        ? fm.activity_tags
        : (fm?.activity_tags ? [fm.activity_tags] : []);
    // Logged means the FULL artifact set this activity owns is present. The
    // flag alone is not enough: activity_pt cannot tell Physical Therapy from
    // Pilates — only the section can. Matches the PWA's projection.
    const hasSection = (title, text) => text.includes(`\n${title}\n`);
    const before = await app.vault.read(file);
    const present =
        hasSection(sectionTitle, before) &&
        (!flagKey || fm?.[flagKey] === true) &&
        tags.every(t => curTags.includes(t));

    if (present) {
        // ---- REMOVE ----
        const flagClaimed = flagClaimSections.some(t => hasSection(t, before));
        const tagClaimed = tagClaimSections.some(t => hasSection(t, before));
        await app.fileManager.processFrontMatter(file, (fm) => {
            if (Array.isArray(fm.activity_tags) && !tagClaimed) {
                fm.activity_tags = fm.activity_tags.filter(t => !tags.includes(t));
            }
            if (flagKey && !flagClaimed) fm[flagKey] = false;
        });

        const content = await app.vault.read(file);
        const lines = content.split("\n");
        const start = lines.findIndex(l => l.trim() === sectionTitle);
        if (start !== -1) {
            let end = lines.length;
            for (let i = start + 1; i < lines.length; i++) {
                if (/^# /.test(lines[i])) { end = i; break; }
            }
            // Keep the section if the user has written notes under it.
            if (lines.slice(start + 1, end).some(l => l.trim() !== "")) {
                new Notice(`${sectionTitle} removed from log — section kept (has notes)`);
                return;
            }
            while (end > start && lines[end - 1].trim() === "") end--;
            lines.splice(start, end - start);
            await app.vault.modify(file, lines.join("\n"));
        }
        new Notice(`${sectionTitle} removed`);
    } else {
        // ---- ADD ----
        await app.fileManager.processFrontMatter(file, (fm) => {
            if (!fm.activity_tags) fm.activity_tags = [];
            for (const t of tags) if (!fm.activity_tags.includes(t)) fm.activity_tags.push(t);
            if (flagKey) fm[flagKey] = true;
        });

        // Re-read after front matter is updated — positions are now accurate.
        const content = await app.vault.read(file);
        if (content.includes(`\n${sectionTitle}\n`)) {
            new Notice(`${sectionTitle} logged`);
            return;
        }

        const lines = content.split("\n");
        const at = lines.findIndex(l => l.trim() === anchor);
        if (at === -1) {
            new Notice(`Could not find ${anchor} section`);
            return;
        }
        lines.splice(at, 0, sectionTitle, "", "");
        await app.vault.modify(file, lines.join("\n"));
        new Notice(`${sectionTitle} logged + section added`);
    }
};

module.exports.settings = {
    name: "Toggle Day Activity",
    author: "syang",
    options: {
        sectionTitle: { type: "text", defaultValue: "" },
        anchor: { type: "text", defaultValue: "# Event" },
        tagsCsv: { type: "text", defaultValue: "" },
        flagKey: { type: "text", defaultValue: "" },
        flagClaimSectionsCsv: { type: "text", defaultValue: "" },
        tagClaimSectionsCsv: { type: "text", defaultValue: "" },
    },
};
