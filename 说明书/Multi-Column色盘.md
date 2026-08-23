---
modified_at: 2026-07-20
---

```dataviewjs
const startHeadinglevel = 2;
const file = app.workspace.getActiveFile();
const { headings } = app.metadataCache.getFileCache(file);

// 全列表的形式
const raws = headings.map( p => {
    let repeatCount = Math.max((p.level - startHeadinglevel) * 4, 0);
    let spacesPrefix = ' '.repeat( repeatCount + 4 );
    let listSign = repeatCount > 0 ? '- ' : '';
    let linkText = `[[#${p.heading}]]`;
    let headingList = (p.level < startHeadinglevel) ? `- ${linkText}` : `${spacesPrefix}- ${linkText}`;
    return headingList;
  }
)

let result = raws.join('\n');
// 添加行距
dv.container.style.lineHeight = "1.5em";
dv.paragraph(result)
```
# 1 Wes Anderson Color Schemes - Glossary

A comprehensive guide to all available color schemes for MCL Multi-Column callouts in Obsidian.

## 1.1 🎬 **Film-Inspired Palettes**

### 1.1.1 🏕️ **Moonrise Kingdom** 
*Scout adventures and coastal summer vibes*

| Color Code | Alternative | Hex Code | Description | Use Case |
|------------|-------------|----------|-------------|----------|
| `moonrise-yellow` | `mk-yellow` | `#F4C430` | Scout uniform yellow | Main content, highlights |
| `moonrise-khaki` | `mk-khaki` | `#BDA466` | Khaki scout colors | Neutral sections, lists |
| `moonrise-red` | `mk-red` | `#B22222` | Summer camp red | Warnings, important notes |
| `moonrise-green` | `mk-green` | `#556B2F` | Forest green | Nature content, success states |
| `moonrise-teal` | `mk-teal` | `#5F9EA0` | Coastal teal | Calm waters, exploration |
| `moonrise-blue` | `mk-blue` | `#4682B4` | Ocean blue | Adventure, discovery |
| `moonrise-pine` | `mk-pine` | `#355E3B` | Pine green | Deep forest, camping |
| `moonrise-sand` | `mk-sand` | `#DAC294` | Beach sand | Background info, context |
| `moonrise-orange` | `mk-orange` | `#FF8C00` | Lighthouse orange | Alerts, action items |
| `moonrise-magenta` | `mk-magenta` | `#C71585` | Suzy's beret magenta | Dramatic content, runaway themes |

**Special Features:** Hand-drawn aesthetic, slight rotations, monospace typography, camping-themed list bullets (🏕️), coastal blues and greens

---

### 1.1.2 🏨 **Grand Budapest Hotel**
*Elegant, ornate, and sophisticated*

| Color Code | Alternative | Hex Code | Description | Use Case |
|------------|-------------|----------|-------------|----------|
| `budapest-pink` | `gbh-pink` | `#F5ABB9` | Signature hotel pink | Primary branding, headers |
| `budapest-purple` | `gbh-purple` | `#663399` | Concierge purple | Formal content, protocols |
| `budapest-gold` | `gbh-gold` | `#DAA520` | Elevator gold | Premium features, highlights |
| `budapest-blue` | `gbh-blue` | `#4682B4` | Mendl's box blue | Details, specifications |
| `budapest-red` | `gbh-red` | `#8B0000` | Lobby red | Important announcements |
| `budapest-cream` | `gbh-cream` | `#FFF8DC` | Cream pastry | Soft backgrounds, quotes |

**Special Features:** Ornate typography, gradient buttons, hotel-themed list bullets (🏨), centered uppercase titles

---

### 1.1.3 🌊 **Hotel Cavalier**
*Art Deco teal and mustard elegance*

| Color Code | Alternative | Hex Code | Description | Use Case |
|------------|-------------|----------|-------------|----------|
| `cavalier-teal` | `hc-teal` | `#008080` | Primary teal | Main branding, headers |
| `cavalier-mustard` | `hc-mustard` | `#DAA520` | Signature mustard | Accent highlights, warmth |
| `cavalier-darkteal` | `hc-darkteal` | `#2F4F4F` | Dark teal | Sophisticated content |
| `cavalier-vintage` | `hc-vintage` | `#CC9933` | Vintage mustard | Retro elements, nostalgia |
| `cavalier-seafoam` | `hc-seafoam` | `#9FE2BF` | Seafoam green | Fresh content, new features |
| `cavalier-brass` | `hc-brass` | `#B5A642` | Brass accent | Luxury details, emphasis |
| `cavalier-turquoise` | `hc-turquoise` | `#40E0D0` | Bright turquoise | Dynamic content, energy |
| `cavalier-deepmustard` | `hc-deepmustard` | `#B8860B` | Deep mustard | Rich, warm sections |

**Special Features:** Thick left borders (6px), Art Deco typography, teal-mustard color harmony, ocean-themed list bullets (🌊)

---

### 1.1.4 🚂 **The Darjeeling Limited**
*Travel, adventure, and exotic destinations*

| Color Code | Alternative | Hex Code | Description | Use Case |
|------------|-------------|----------|-------------|----------|
| `darjeeling-blue` | `dl-blue` | `#191970` | Train blue | Transportation, journeys |
| `darjeeling-saffron` | `dl-saffron` | `#F4C430` | Saffron yellow | Spices, exotic content |
| `darjeeling-curry` | `dl-curry` | `#FFA500` | Curry orange | Warm, inviting sections |
| `darjeeling-brown` | `dl-brown` | `#8B4513` | Luggage brown | Travel gear, practical info |
| `darjeeling-red` | `dl-red` | `#DC143C` | Paisley red | Cultural content, traditions |
| `darjeeling-green` | `dl-green` | `#228B22` | Monsoon green | Nature, growth, renewal |

**Special Features:** Dashed borders, film stripe effect, vintage typography, train-themed list bullets (🚂)

---

### 1.1.5 🛸 **Asteroid City**
*Desert sci-fi and atomic age aesthetics*

| Color Code | Alternative | Hex Code | Description | Use Case |
|------------|-------------|----------|-------------|----------|
| `asteroid-sand` | `ac-sand` | `#EECBAD` | Desert sand | Primary backgrounds, earth tones |
| `asteroid-orange` | `ac-orange` | `#FF6347` | Atomic orange | Energy, alerts, space themes |
| `asteroid-turquoise` | `ac-turquoise` | `#40E0D0` | Sky turquoise | Sci-fi elements, technology |
| `asteroid-rust` | `ac-rust` | `#B7410E` | Desert rust | Industrial, weathered content |
| `asteroid-sage` | `ac-sage` | `#9EA98B` | Sage green | Natural, muted sections |
| `asteroid-blue` | `ac-blue` | `#4682B4` | Atomic blue | Scientific, technical content |
| `asteroid-pink` | `ac-pink` | `#FFB6C1` | Retro pink | Nostalgic, 1950s themes |
| `asteroid-black` | `ac-black` | `#2F4F4F` | Space black | Dark, mysterious content |
| `asteroid-yellow` | `ac-yellow` | `#FFFFE0` | Motel yellow | Vintage, roadside Americana |

**Special Features:** Atomic age styling, starfield backgrounds, UFO-themed list bullets (🛸), retro sci-fi typography

---

## 1.2 🎨 **Additional Color Collections**

### 1.2.1 🌸 **Pastel Dreams**
*Soft, dreamy, and ethereal*

| Color Code | Hex Code | Description | Best For |
|------------|----------|-------------|----------|
| `pastel-lavender` | `#E6E6FA` | Soft purple-gray | Calm content, meditation |
| `pastel-sage` | `#BCD4B3` | Muted green | Natural, organic content |
| `pastel-blush` | `#FFE4E1` | Light pink | Gentle highlights, romance |
| `pastel-sky` | `#B0E0E6` | Soft blue | Aspirational content, dreams |

**Special Features:** Subtle blur effects, italic serif typography, soft shadows

---

### 1.2.2 📻 **Vintage Collection**
*Retro, nostalgic, and timeless*

| Color Code | Hex Code | Description | Best For |
|------------|----------|-------------|----------|
| `vintage-mustard` | `#FFDB58` | Classic yellow-brown | Retro designs, old documents |
| `vintage-rust` | `#B7410E` | Deep orange-brown | Industrial content, history |
| `vintage-forest` | `#2D4520` | Dark green | Traditional, established content |

**Special Features:** Film grain texture, retro shadows, aged appearance

---

## 1.3 🔧 **Original Color System**
*Base colors that started it all*

### 1.3.1 Background Colors (`bg-`)
| Code | Hex Code | Color | Use Case |
|------|----------|-------|----------|
| `bg-red` | `#FF3B30` | Bright red | Errors, urgent items |
| `bg-blue` | `#007AFF` | System blue | Information, links |
| `bg-green` | `#34C759` | Success green | Completed items, success |
| `bg-orange` | `#FF9500` | Warning orange | Cautions, pending items |
| `bg-purple` | `#AF52DE` | Purple | Creative content, special |
| `bg-yellow` | `#FFCC00` | Bright yellow | Highlights, attention |
| `bg-pink` | `#FF2D55` | Hot pink | Fun content, celebrations |
| `bg-teal` | `#30B0C7` | Teal blue | Cool, professional |
| `bg-indigo` | `#5856D6` | Deep blue | Technical, detailed |
| `bg-gray` | `#8E8E93` | Neutral gray | Subdued, background info |

### 1.3.2 Solid Colors (`color-`)
| Code | Hex Code | Color | Use Case |
|------|----------|-------|----------|
| `color-red` | `#FF3B30` | Intense red | Critical alerts |
| `color-blue` | `#007AFF` | Intense blue | Primary information |
| `color-green` | `#34C759` | Intense green | Success confirmation |
| `color-orange` | `#FF9500` | Intense orange | Strong warnings |
| `color-purple` | `#AF52DE` | Intense purple | Special emphasis |

---

## 1.4 📏 **Width Modifiers**
*Combine with any color for layout control*

| Modifier | Effect | Example Usage |
|----------|--------|---------------|
| `wide-1` | Standard width (1x) | `budapest-pink\|wide-1` |
| `wide-2` | Double width (2x) | `mk-yellow\|wide-2` |
| `wide-3` | Triple width (3x) | `cavalier-teal\|wide-3` |
| `wide-4` | Quadruple width (4x) | `dl-blue\|wide-4` |
| `narrow` | Half width (0.5x) | `pastel-lavender\|narrow` |
| `fixed-200` | Fixed 200px width | `vintage-mustard\|fixed-200` |
| `fixed-300` | Fixed 300px width | `gbh-gold\|fixed-300` |
| `min-0` | No minimum width | `bg-gray\|min-0` |

---

## 1.5 💡 **Usage Examples**

### 1.5.1 Basic Multi-Column Layout
```markdown
> [!multi-column]
>
>> [!info|budapest-pink] Elegant Content
>> This uses the signature Grand Budapest Hotel pink
>
>> [!note|mk-yellow] Scout Notes  
>> This has the Moonrise Kingdom yellow with camping vibes
>
>> [!tip|cavalier-teal] Art Deco Tips
>> This features the Hotel Cavalier ocean teal
```

### 1.5.2 Mixed Widths and Colors
```markdown
> [!multi-column]
>
>> [!quote|darjeeling-saffron|wide-2] Main Article
>> This takes up twice the width with exotic saffron coloring
>
>> [!info|pastel-lavender|narrow] Side Notes
>> This is a narrow column with dreamy lavender
>
>> [!warning|vintage-rust] Historical Context
>> Standard width with vintage rust coloring
```

### 1.5.3 Themed Workspace
```markdown
> [!multi-column]
>
>> [!info|gbh-pink] Hotel Services
>> - Concierge available 24/7
>> - Room service menu
>> - Spa appointments
>
>> [!note|gbh-purple] Dress Code
>> - Formal attire required
>> - No athletic wear
>> - Ties preferred
>
>> [!tip|gbh-gold] Amenities
>> - Luxury spa
>> - Fine dining
>> - Private library
```

### 1.5.4 Asteroid City Sci-Fi Layout
```markdown
> [!multi-column]
>
>> [!info|asteroid-sand|wide-2] Desert Observatory
>> The remote research station monitors celestial phenomena
>
>> [!warning|asteroid-orange] Atomic Alert
>> Radiation levels elevated in sector 7
>
>> [!note|asteroid-turquoise] UFO Sightings
>> - 14:30 - Unidentified craft spotted
>> - 15:45 - Object disappeared
>> - 16:00 - Investigation pending
```

---

## 1.6 🎨 **Color Psychology Guide**

**Warm Colors** (Energy, Attention, Comfort)
- Reds: `budapest-red` (#8B0000), `mk-red` (#B22222), `dl-red` (#DC143C), `asteroid-rust` (#B7410E), `bg-red` (#FF3B30)
- Oranges: `mk-orange` (#FF8C00), `dl-curry` (#FFA500), `asteroid-orange` (#FF6347), `bg-orange` (#FF9500)
- Yellows: `mk-yellow` (#F4C430), `dl-saffron` (#F4C430), `gbh-gold` (#DAA520), `cavalier-mustard` (#DAA520), `asteroid-yellow` (#FFFFE0), `bg-yellow` (#FFCC00)

**Cool Colors** (Calm, Professional, Trust)
- Blues: `gbh-blue` (#4682B4), `dl-blue` (#191970), `mk-blue` (#4682B4), `asteroid-blue` (#4682B4), `pastel-sky` (#B0E0E6), `bg-blue` (#007AFF)
- Greens: `mk-green` (#556B2F), `mk-pine` (#355E3B), `dl-green` (#228B22), `asteroid-sage` (#9EA98B), `vintage-forest` (#2D4520), `bg-green` (#34C759)
- Teals: `cavalier-teal` (#008080), `cavalier-darkteal` (#2F4F4F), `mk-teal` (#5F9EA0), `asteroid-turquoise` (#40E0D0), `bg-teal` (#30B0C7)

**Neutral Colors** (Balance, Sophistication)
- Browns: `dl-brown` (#8B4513), `vintage-rust` (#B7410E), `asteroid-rust` (#B7410E)
- Sands: `mk-khaki` (#BDA466), `mk-sand` (#DAC294), `asteroid-sand` (#EECBAD)
- Grays: `asteroid-black` (#2F4F4F), `bg-gray` (#8E8E93)
- Creams: `gbh-cream` (#FFF8DC), `asteroid-yellow` (#FFFFE0)

**Accent Colors** (Creativity, Fun, Special)
- Purples: `gbh-purple` (#663399), `bg-purple` (#AF52DE), `pastel-lavender` (#E6E6FA)
- Pinks: `gbh-pink` (#F5ABB9), `asteroid-pink` (#FFB6C1), `pastel-blush` (#FFE4E1), `bg-pink` (#FF2D55)
- Aquas: `cavalier-turquoise` (#40E0D0), `asteroid-turquoise` (#40E0D0), `cavalier-seafoam` (#9FE2BF), `pastel-sage` (#BCD4B3)
- Purples: `gbh-purple` (#663399), `bg-purple` (#AF52DE), `pastel-lavender` (#E6E6FA)
- Pinks: `gbh-pink` (#F5ABB9), `pastel-blush` (#FFE4E1), `bg-pink` (#FF2D55)
- Aquas: `cavalier-turquoise` (#40E0D0), `cavalier-seafoam` (#9FE2BF), `pastel-sage` (#BCD4B3)

---

## 1.7 🔄 **Dark Theme Compatibility**

All colors automatically adjust for dark themes with:
- Reduced opacity backgrounds
- Maintained border visibility
- Optimized contrast ratios
- Consistent visual hierarchy

---

*This glossary covers all available colors in the enhanced MCL Multi-Column system. Mix and match to create the perfect aesthetic for your Obsidian workspace!*