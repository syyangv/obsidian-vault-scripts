// Pure computation behind Helper/utils/recipeTracker.md, extracted so a vault
// listener can refresh a recipe's frontmatter without rendering the note.
// Save as: Helper/utils/recipeStats.js   (Templater user script: tp.user.recipeStats)
//
// This is a COPY of the math in recipeTracker.md's dataviewjs block, not a
// replacement for it. The block stays authoritative; equivalence.mjs compares the
// two against the frontmatter the block has already written.

const MS_PER_DAY = 86400000;

// 'YYYY-MM-DD' -> whole days since the epoch. UTC on purpose: moment's
// diff(..., 'days') is a calendar-day difference, which a UTC day count matches
// across DST changes.
function dayNumber(name) {
    const [y, m, d] = name.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

const monthOf = (name) => Number(name.split('-')[1]);

// Frontmatter fields the tracker deletes when no daily note links the recipe.
const CLEAN_FIELDS = [
    'last_cooked', 'first_cooked', 'cooking_count',
    'cooking_frequency', 'favorite_season', 'recent_activity',
    'cooking_years', 'cooking_patterns',
];

/**
 * @param {{name: string, year: string}[]} entries  one per daily-note PAGE that
 *   links the recipe (pages, not links). name is 'YYYY-MM-DD', year is the
 *   folder's second segment ('日记/2026' -> '2026').
 * @param {string} today  'YYYY-MM-DD'
 * @returns {object|null} the frontmatter fields to write, or null when there are
 *   no entries (the caller then deletes CLEAN_FIELDS). `cooking_patterns` is null
 *   when the tracker would leave the existing value untouched.
 */
function recipeStats(entries, today) {
    if (entries.length === 0) return null;

    // dates sorted by file name, descending (as the tracker's .sort(p => p.file.name, 'desc'))
    const dates = [...entries].sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
    const firstDate = dates[dates.length - 1].name;
    const lastDate = dates[0].name;
    const totalCount = dates.length;

    const daysBetween = dayNumber(lastDate) - dayNumber(firstDate) + 1;
    const frequency = totalCount > 1 ? Math.round(daysBetween / totalCount) : 0;
    const recentCooking = dates.filter((p) => dayNumber(today) - dayNumber(p.name) <= 30).length;

    const seasonCounts = {
        春季: dates.filter((p) => [3, 4, 5].includes(monthOf(p.name))).length,
        夏季: dates.filter((p) => [6, 7, 8].includes(monthOf(p.name))).length,
        秋季: dates.filter((p) => [9, 10, 11].includes(monthOf(p.name))).length,
        冬季: dates.filter((p) => [12, 1, 2].includes(monthOf(p.name))).length,
    };
    // reduce with a strict `>`: a tie goes to the LATER key, as in the tracker.
    const favoriteSeason = Object.keys(seasonCounts).reduce((a, b) =>
        seasonCounts[a] > seasonCounts[b] ? a : b
    );

    // The tracker's display line calls years.sort() in place before the frontmatter
    // write reads it, so what lands in frontmatter is ascending. Sorted here on purpose.
    const years = [...new Set(dates.map((p) => p.year))].sort();

    const patterns = [];
    if (recentCooking >= 3) patterns.push('频繁制作');
    if (frequency <= 7) patterns.push('常做菜品');
    if (totalCount >= 10) patterns.push('经典菜谱');
    if (years.length >= 2) patterns.push('长期收藏');

    return {
        first_cooked: firstDate,
        last_cooked: lastDate,
        cooking_count: totalCount,
        cooking_frequency: frequency,
        favorite_season: favoriteSeason,
        recent_activity: recentCooking,
        cooking_years: years,
        cooking_patterns: patterns.length > 0 ? patterns : null,
    };
}

// 'path#heading|alias' -> {path, display}. Dataview's Link.path excludes the
// #subpath, and .display is the alias.
function parseLink(raw) {
    const [target, alias] = raw.split('|');
    return { path: target.split('#')[0].trim(), display: alias === undefined ? undefined : alias.trim() };
}

// The tracker's own (substring) match: l.path.includes(recipe) || l.display === recipe.
// Substring is a quirk, kept because the count must agree with what the tracker writes.
function linksRecipe(links, recipe) {
    return links.some((l) => l.path.includes(recipe) || l.display === recipe);
}

recipeStats.CLEAN_FIELDS = CLEAN_FIELDS;
recipeStats.parseLink = parseLink;
recipeStats.linksRecipe = linksRecipe;
module.exports = recipeStats;
