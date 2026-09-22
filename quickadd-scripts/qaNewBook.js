const { requestUrl, Notice } = require("obsidian");

const BOOK_FOLDER = "知识库/读书笔记";
const COVER_FOLDER = "Attachments/cover/书";
const TEMPLATE_PATH = "Helper/Templates/读书笔记.md";

const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function yamlString(value) {
    return JSON.stringify(value ?? "");
}

function sanitizeFileName(name) {
    return String(name || "")
        .replace(/[\\/:*?"<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getToday() {
    return window.moment().format("YYYY-MM-DD");
}

function scoreToStars(score) {
    const val = parseFloat(score);
    if (isNaN(val) || val <= 0) return "";
    const count = Math.max(1, Math.min(5, Math.round(val / 2.0)));
    return "⭐".repeat(count);
}

function cleanHtml(str) {
    if (!str) return "";
    return str
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function extractDoubanId(input) {
    const trimmed = String(input || "").trim();
    if (/^\d{5,12}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/douban\.com\/subject\/(\d+)/);
    return match ? match[1] : null;
}

function getAvailableBookPath(app, title) {
    const safeTitle = sanitizeFileName(title);
    let candidate = `${BOOK_FOLDER}/${safeTitle}.md`;
    let index = 1;

    while (app.vault.getAbstractFileByPath(candidate)) {
        candidate = `${BOOK_FOLDER}/${safeTitle} ${index}.md`;
        index += 1;
    }

    return candidate;
}

async function getBookTemplateBody(app) {
    const templateFile = app.vault.getAbstractFileByPath(TEMPLATE_PATH);
    if (!templateFile) {
        return `![[noteNav]]
**阅读渠道:** \`INPUT[inlineListSuggester(option(Audible),option(Libby)):阅读渠道]\`
# 1 进度
# 2 读书笔记
`;
    }

    const templateContent = await app.vault.read(templateFile);
    const frontmatterMatch = templateContent.match(/^---\n[\s\S]*?\n---\n?/);
    return frontmatterMatch ? templateContent.slice(frontmatterMatch[0].length) : templateContent;
}

async function openFile(app, file) {
    const leaf = app.workspace.getLeaf("tab");
    await leaf.openFile(file);
}

async function searchDouban(keyword) {
    const url = `https://www.douban.com/search?cat=1001&q=${encodeURIComponent(keyword)}`;
    const resp = await requestUrl({
        url,
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
    });

    if (resp.status !== 200 || !resp.text) return [];

    const html = resp.text;
    const itemRegex = /<div class="result">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const results = [];
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
        const itemHtml = match[1];
        const sidMatch =
            itemHtml.match(/sid:\s*(\d+)/) ||
            itemHtml.match(/subject%2F(\d+)%2F/) ||
            itemHtml.match(/subject\/(\d+)\//);
        if (!sidMatch) continue;

        const titleMatch =
            itemHtml.match(/<a[^>]*onclick="[^"]*"[^>]*>([^<]+)<\/a>/) ||
            itemHtml.match(/<h3>\s*<span>\[[^\]]+\]<\/span>\s*<a[^>]*>([^<]+)<\/a>/);
        const title = titleMatch ? cleanHtml(titleMatch[1]) : "";
        if (!title) continue;

        const ratingMatch = itemHtml.match(/<span class="rating_nums">([^<]+)<\/span>/);
        const score = ratingMatch ? cleanHtml(ratingMatch[1]) : "";

        const castMatch = itemHtml.match(/<span class="subject-cast">([^<]+)<\/span>/);
        const cast = castMatch ? cleanHtml(castMatch[1]) : "";

        const imgMatch = itemHtml.match(/<img\s+src="([^"]+)"/);
        const img = imgMatch ? imgMatch[1].trim() : "";

        results.push({
            doubanId: sidMatch[1],
            title,
            score,
            cast,
            coverUrl: img,
        });
        if (results.length >= 10) break;
    }

    return results;
}

async function fetchDoubanBookDetail(doubanId) {
    const url = `https://book.douban.com/subject/${doubanId}/`;
    const resp = await requestUrl({
        url,
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
    });

    if (resp.status !== 200 || !resp.text) return null;
    const html = resp.text;

    let ld = {};
    const ldMatch = html.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (ldMatch) {
        try {
            ld = JSON.parse(ldMatch[1]);
        } catch (_) {}
    }

    let title = cleanHtml(ld.name || "");
    if (!title) {
        const ogTitle = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/);
        title = ogTitle ? cleanHtml(ogTitle[1]) : "";
    }
    if (!title) return null;

    let authors = [];
    if (Array.isArray(ld.author)) {
        authors = ld.author
            .map((a) => (typeof a === "object" && a ? a.name : a))
            .filter(Boolean)
            .map(cleanHtml);
    }
    if (authors.length === 0) {
        const authorMatch = html.match(/<span class=["']pl["']>\s*作者\s*<\/span>:([\s\S]*?)<br/);
        if (authorMatch) {
            const matches = authorMatch[1].match(/<a[^>]*>([^<]+)<\/a>/g) || [];
            authors = matches.map((m) => cleanHtml(m.replace(/<[^>]+>/g, ""))).filter(Boolean);
        }
    }

    let isbn = cleanHtml(ld.isbn || "");
    if (!isbn) {
        const isbnMatch = html.match(/<span class=["']pl["']>\s*ISBN:\s*<\/span>\s*([^<\n\r]+)/);
        isbn = isbnMatch ? cleanHtml(isbnMatch[1]) : "";
    }

    const pagesMatch = html.match(/<span class=["']pl["']>\s*页数:\s*<\/span>\s*(\d+)/);
    const totalPage = pagesMatch ? parseInt(pagesMatch[1], 10) : null;

    const pubMatch = html.match(/<span class=["']pl["']>\s*出版社:\s*<\/span>\s*(?:<a[^>]*>)?\s*([^<\n\r]+)/);
    const publisher = pubMatch ? cleanHtml(pubMatch[1]) : "";

    const dateMatch = html.match(/<span class=["']pl["']>\s*出版年:\s*<\/span>\s*([^<\n\r]+)/);
    const datePublished = dateMatch ? cleanHtml(dateMatch[1]) : "";

    const priceMatch = html.match(/<span class=["']pl["']>\s*定价:\s*<\/span>\s*([^<\n\r]+)/);
    const price = priceMatch ? cleanHtml(priceMatch[1].replace("元", "")) : "";

    const bindingMatch = html.match(/<span class=["']pl["']>\s*装帧:\s*<\/span>\s*([^<\n\r]+)/);
    const binding = bindingMatch ? cleanHtml(bindingMatch[1]) : "";

    const seriesMatch = html.match(/<span class=["']pl["']>\s*丛书:\s*<\/span>\s*(?:<a[^>]*>)?\s*([^<\n\r]+)/);
    const series = seriesMatch ? cleanHtml(seriesMatch[1]) : "";

    const transMatch = html.match(/<span class=["']pl["']>\s*译者\s*<\/span>:([\s\S]*?)<br/);
    let translators = [];
    if (transMatch) {
        const matches = transMatch[1].match(/<a[^>]*>([^<]+)<\/a>/g) || [];
        translators = matches.map((m) => cleanHtml(m.replace(/<[^>]+>/g, ""))).filter(Boolean);
    }

    const subMatch = html.match(/<span class=["']pl["']>\s*副标题:\s*<\/span>\s*([^<\n\r]+)/);
    const subTitle = subMatch ? cleanHtml(subMatch[1]) : "";

    const origMatch = html.match(/<span class=["']pl["']>\s*原作名:\s*<\/span>\s*([^<\n\r]+)/);
    const originalTitle = origMatch ? cleanHtml(origMatch[1]) : "";

    const scoreMatch = html.match(/property=["']v:average["']>([^<]+)<\/strong>/);
    const score = scoreMatch ? cleanHtml(scoreMatch[1]) : "";

    let desc = "";
    const descMatch = html.match(/id=["']link-report["']>[\s\S]*?<div class=["']intro["']>([\s\S]*?)<\/div>/);
    if (descMatch) {
        const paragraphs = descMatch[1].match(/<p>([^<]+)<\/p>/g) || [];
        desc = paragraphs.map((p) => cleanHtml(p.replace(/<[^>]+>/g, ""))).join("");
    }

    const coverMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/);
    const coverUrl = coverMatch ? coverMatch[1].trim() : "";

    return {
        doubanId,
        title,
        subTitle,
        originalTitle,
        author: authors,
        translator: translators,
        publisher,
        datePublished,
        totalPage,
        price,
        binding,
        series,
        isbn,
        score,
        scoreStar: scoreToStars(score),
        desc,
        coverUrl,
        url: `https://book.douban.com/subject/${doubanId}/`,
    };
}

async function saveCoverImage(app, safeTitle, coverUrl) {
    if (!coverUrl || !coverUrl.startsWith("http")) return "";

    const highResUrl = coverUrl
        .replace("/subject/s/public/", "/subject/l/public/")
        .replace("/subject/m/public/", "/subject/l/public/");

    try {
        const resp = await requestUrl({
            url: highResUrl,
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://book.douban.com/",
            },
        });

        if (resp.status !== 200 || !resp.arrayBuffer || resp.arrayBuffer.byteLength < 500) {
            return "";
        }

        if (!await app.vault.adapter.exists(COVER_FOLDER)) {
            await app.vault.adapter.mkdir(COVER_FOLDER);
        }

        const coverPath = `${COVER_FOLDER}/${safeTitle}.jpg`;
        if (!await app.vault.adapter.exists(coverPath)) {
            await app.vault.createBinary(coverPath, resp.arrayBuffer);
        }
        return `${safeTitle}.jpg`;
    } catch (err) {
        console.warn("Download book cover failed:", err);
        return "";
    }
}

async function createDoubanBookNote(app, book, status) {
    const safeTitle = sanitizeFileName(book.title);
    const today = getToday();
    const started = status === "在读" || status === "在看" ? today : "";
    const path = getAvailableBookPath(app, safeTitle);
    const body = await getBookTemplateBody(app);

    // Save cover image
    const coverFile = await saveCoverImage(app, safeTitle, book.coverUrl);
    const coverVal = coverFile ? `"[[${coverFile}]]"` : "";

    const authorYaml = book.author && book.author.length > 0
        ? "\n" + book.author.map((a) => `  - ${a}`).join("\n")
        : ' ""';

    const translatorYaml = book.translator && book.translator.length > 0
        ? "\n" + book.translator.map((t) => `  - ${t}`).join("\n")
        : ' ""';

    const content = `---
aliases:
doubanId: "${book.doubanId || ""}"
title: ${yamlString(safeTitle)}
subTitle: ${yamlString(book.subTitle || "")}
originalTitle: ${yamlString(book.originalTitle || "")}
series: ${yamlString(book.series || "")}
type: "book"
author:${authorYaml}
score: "${book.score || ""}"
scoreStar: ${book.scoreStar || '""'}
myRating: ""
myRatingStar: ""
datePublished: ${book.datePublished || ""}
translator:${translatorYaml}
publisher: ${book.publisher || '""'}
producer: ""
isbn: "${book.isbn || ""}"
url: ${book.url || '""'}
totalPage: ${book.totalPage != null ? book.totalPage : ""}
price: "${book.price || ""}"
tags: []
status:
  - ${status}
binding: ${book.binding || '""'}
collectionDate:
desc: ${yamlString(book.desc || "")}
开始日期: ${started}
完成日期:
个人评分:
完成页数: 0
cssclasses:
cover: ${coverVal}
modified_at: ${today}
---
${body}`;

    const file = await app.vault.create(path, content);
    await openFile(app, file);
    new Notice(`✅ 成功导入豆瓣书籍: ${safeTitle} (${status})`);
}

async function createManualBookNote(app, quickAddApi, status) {
    const title = await quickAddApi.inputPrompt("书名");
    if (!title) return;

    const safeTitle = sanitizeFileName(title);
    if (!safeTitle) {
        new Notice("书名不能为空");
        return;
    }

    const today = getToday();
    const started = status === "在读" || status === "在看" ? today : "";
    const body = await getBookTemplateBody(app);
    const path = getAvailableBookPath(app, safeTitle);
    const content = `---
aliases:
doubanId: ""
title: ${yamlString(safeTitle)}
subTitle: ""
originalTitle: ""
series: ""
type: "book"
author: ""
score: ""
scoreStar: ""
myRating: ""
myRatingStar: ""
datePublished:
translator: ""
publisher: ""
producer: ""
isbn: ""
url: ""
totalPage:
price: ""
tags: []
status:
  - ${status}
binding: ""
collectionDate:
desc: ""
开始日期: ${started}
完成日期:
个人评分:
完成页数: 0
cssclasses:
cover:
modified_at: ${today}
---
${body}`;

    const file = await app.vault.create(path, content);
    await openFile(app, file);
    new Notice(`✅ 已创建读书笔记: ${safeTitle} (${status})`);
}

module.exports = async (params) => {
    const { app, quickAddApi } = params;

    const action = await quickAddApi.suggester(
        ["🔍 从豆瓣搜索导入", "✍️ 直接手动新建"],
        ["douban", "manual"]
    );
    if (!action) return;

    const status = await quickAddApi.suggester(
        ["想读", "在读", "在看", "想看"],
        ["想读", "在读", "在看", "想看"]
    );
    if (!status) return;

    if (action === "manual") {
        await createManualBookNote(app, quickAddApi, status);
        return;
    }

    // Douban Import
    const input = await quickAddApi.inputPrompt("书名、关键词或豆瓣链接");
    if (!input) return;

    new Notice("正在连接豆瓣…");
    const directId = extractDoubanId(input);
    let bookDetail = null;

    if (directId) {
        bookDetail = await fetchDoubanBookDetail(directId);
        if (!bookDetail) {
            new Notice(`无法读取豆瓣书籍 ID: ${directId}`);
            return;
        }
    } else {
        const searchResults = await searchDouban(input);
        if (!searchResults || searchResults.length === 0) {
            new Notice("豆瓣未找到相关书籍");
            const createManual = await quickAddApi.suggester(
                ["直接以此书名手动新建", "取消"],
                [true, false]
            );
            if (createManual) {
                await createManualBookNote(app, quickAddApi, status);
            }
            return;
        }

        const displayItems = searchResults.map(
            (r) => `${r.score ? `[${r.score}分] ` : ""}${r.title} - ${r.cast || "豆瓣"}`
        );
        const selected = await quickAddApi.suggester(displayItems, searchResults);
        if (!selected) return;

        new Notice(`正在获取《${selected.title}》详细信息…`);
        bookDetail = await fetchDoubanBookDetail(selected.doubanId);
        if (!bookDetail) {
            // Fallback to basic info from search result
            bookDetail = {
                doubanId: selected.doubanId,
                title: selected.title,
                subTitle: "",
                originalTitle: "",
                author: selected.cast ? [selected.cast.split("/")[0].trim()] : [],
                translator: [],
                publisher: "",
                datePublished: "",
                totalPage: null,
                price: "",
                binding: "",
                series: "",
                isbn: "",
                score: selected.score,
                scoreStar: scoreToStars(selected.score),
                desc: "",
                coverUrl: selected.coverUrl,
                url: `https://book.douban.com/subject/${selected.doubanId}/`,
            };
        }
    }

    await createDoubanBookNote(app, bookDetail, status);
};
