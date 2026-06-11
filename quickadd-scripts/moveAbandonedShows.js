module.exports = async (params) => {
  const { app } = params;
  const sourceFolder = "看电视";
  const targetFolder = "看电视/弃";
  const targetTag = "弃剧";

  const targetFolderObj = app.vault.getAbstractFileByPath(targetFolder);
  if (!targetFolderObj) {
    await app.vault.createFolder(targetFolder);
  }

  const allFiles = app.vault.getMarkdownFiles();
  const candidates = allFiles.filter(function(f) {
    var parts = f.path.split("/");
    return parts.length === 2 && parts[0] === sourceFolder;
  });

  var moved = 0;
  for (var i = 0; i < candidates.length; i++) {
    var file = candidates[i];
    var cache = app.metadataCache.getFileCache(file);
    if (!cache) continue;

    var fmTags = (cache.frontmatter && cache.frontmatter.tags) ? cache.frontmatter.tags : [];
    var normalizedFmTags = Array.isArray(fmTags)
      ? fmTags.map(function(t) { return String(t).replace(/^#/, ""); })
      : [String(fmTags).replace(/^#/, "")];

    var inlineTags = (cache.tags || []).map(function(t) { return t.tag.replace(/^#/, ""); });

    var allTags = normalizedFmTags.concat(inlineTags);
    if (allTags.indexOf(targetTag) === -1) continue;

    var newPath = targetFolder + "/" + file.name;
    await app.vault.rename(file, newPath);
    moved++;
  }

  var msg = moved > 0
    ? "已将 " + moved + " 部弃剧移至 " + targetFolder + "/"
    : "没有找到带有「弃剧」标签的剧集";
  new Notice(msg);
};
