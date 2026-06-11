const BOOK_FOLDER = "知识库/读书笔记";
const TEMPLATE_PATH = "Helper/Templates/读书笔记.md";
const DOUBAN_COMMAND = "obsidian-douban-plugin:searcher-douban-import-and-create-file-book";

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
![[bookProgress]]
**阅读渠道:** \`INPUT[inlineListSuggester(option(Audible),option(Libby)):阅读渠道]\`
# 1 进度
# 2 [[Readwise/Books/\`this.title\`|读书笔记]]
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

async function applyStatus(app, file, status) {
    const today = getToday();

    await app.fileManager.processFrontMatter(file, (fm) => {
        fm.status = [status];

        if (status === "在看") {
            if (!fm["开始日期"]) {
                fm["开始日期"] = today;
            }
        } else {
            fm["开始日期"] = "";
        }
    });
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
    const body = await getBookTemplateBody(app);
    const path = getAvailableBookPath(app, safeTitle);
    const content = `---
aliases:
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
开始日期: ${status === "在看" ? today : ""}
完成日期:
完成页数: 0
阅读渠道:
cssclasses:
cover:
---
${body}`;

    const file = await app.vault.create(path, content);
    await openFile(app, file);
    new Notice(`已创建读书笔记: ${safeTitle}`);
}

async function importFromDouban(app, status) {
    const beforeMtimes = new Map(
        app.vault.getMarkdownFiles()
            .filter((file) => file.path.startsWith(`${BOOK_FOLDER}/`))
            .map((file) => [file.path, file.stat.mtime])
    );

    const executed = await app.commands.executeCommandById(DOUBAN_COMMAND);
    if (executed === false) {
        new Notice("没有找到豆瓣导入命令");
        return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 800));

    const bookFiles = app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${BOOK_FOLDER}/`));
    const changedFiles = bookFiles.filter((file) => {
        const previousMtime = beforeMtimes.get(file.path);
        return previousMtime == null || file.stat.mtime > previousMtime;
    });

    const targetFile = changedFiles
        .slice()
        .sort((a, b) => b.stat.mtime - a.stat.mtime)[0];

    if (!targetFile) {
        new Notice("没有检测到新导入的读书笔记");
        return;
    }

    await applyStatus(app, targetFile, status);
    await openFile(app, targetFile);
    new Notice(`已导入并设置状态: ${targetFile.basename} -> ${status}`);
}

module.exports = async (params) => {
    const { app, quickAddApi } = params;

    const shouldImport = await quickAddApi.suggester(
        ["是，从豆瓣导入", "否，直接新建"],
        [true, false]
    );
    if (shouldImport == null) return;

    const status = await quickAddApi.suggester(
        ["想看", "在看"],
        ["想看", "在看"]
    );
    if (!status) return;

    if (shouldImport) {
        await importFromDouban(app, status);
        return;
    }

    await createManualBookNote(app, quickAddApi, status);
};
