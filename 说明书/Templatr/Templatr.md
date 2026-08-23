---
aliases: []
tags: []
modified_at: 2026-07-19
---

```meta-bind-button
style: primary
label: Open Documentation
action:
  type: open
  link: https://silentvoid13.github.io/Templater/
```

[Bookmark](https://silentvoid13.github.io/Templater/internal-functions/contribute.html)
# 1 Functions
- Format: &lt;% tp.user.myFunction() %>
- 放在一个 template 中时去掉 `+`, 不加的话会直接 translate，无法作为变量
	- Exception: link 到一个 note 时，在 template 里不带 `+`
- `tp.date`
	- <%+ tp.date.now("YYYY-MM-DD") %>, <%+ tp.date.yesterday("YYYY-MM-DD") %>
	- <%+ tp.date.now("YYYY-MM-DD", "P-1M") %>, <%+ tp.date.now("YYYY-MM-DD", "P-1Y") %>
	- Can be configured as a link [[<%+ tp.date.now("YYYY-MM-DD") %>]]
- `tp.file`
	- <%+ tp.file.creation_date("YYYY-MM-DD") %>
	- <%+ tp.file.path(relative=1) %>
	- <%+ tp.file.folder() %>
# 2 示例Templates
- [[Daily Note]]
- [[Weekly Note]]
# 3 示例 Queries
- 本篇笔记的标题: <%+ tp.file.title.slice(0) %>
	- <%*+ tR += tp.file.title.slice(0) %>

# 4 自定义 scripts: [[utils]]
## 4.1 Functions
-  [[tickGrid.js]]: 用于 list of todos, e.g.书的章节 [[tickGrid]]
## 4.2 Scripts
`                    <%tp.file.include("[[note.filename]]")%>                    `
