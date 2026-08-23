---
tags:
aliases: []
modified_at: 2026-07-19
---
```meta-bind-button
style: primary
label: Open Documentation
action:
  type: open
  link: https://github.com/pyrochlore/obsidian-tracker/blob/master/docs/InputParameters.md
```

> [!Example]- Reference
> [[Monthly Note]]
# Habit Tracker -- boolean property in frontmatter (0/1)
Calendar View
````
```tracker
searchType: frontmatter
searchTarget: <property> \#e.g. Task 1
folder: <>
startDate: <YYYY-MM-DD>
endDate: <YYYY-MM-DD>
fixedScale: 1.3 # optional

# VIEWS
month: # month view of tracking
mode: annotation \#optional
annotation: <emoji> \#optional
	startWeekOn: 'Sun'
	color: <>
	
# OR
summary:
	template: "" # string with variables for formatting
```
````

# Value Tracker -- numeric property in frontmatter
````
# VIEWS
line:
	title: <log name>
	yAxisLabel: <>
	yAxisUnit: <>
# OR
bar:
````

# Word Tracker -- automated property
```tracker
searchType: fileMeta
searchTarget: numWords
folder: 日记
startDate: 2025-04-01
line:
	title: Word Counter
```
