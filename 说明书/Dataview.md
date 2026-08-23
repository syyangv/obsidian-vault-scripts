---
modified_at: 2026-07-19
---
# DQL
Similar to SQL with what comes after `SELECT`
-  `property` is the metadata property within a note
- Can contain `AND/OR/-` (not)
- `file.size` in kb
 ````markdow
```dataview
LIST
FROM #<tag> 
or "<note>" 
or "<folder/note>" 
or [[<note>]] # incoming link 
or outgoing([<note>]) # outgoing links
```
```dataview
TABLE # output format <property> AS <new colname>
WHERE file.<name> = <...> 
or CONTAINS(<property>, "...")
SORT <property> ASC or DESC
```
```dataview
TASK
```
````