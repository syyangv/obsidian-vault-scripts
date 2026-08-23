---
aliases:
完成页数: 50
status:
  - in progress
最后review日期: 2025-05-23
test: false
cssclasses:
  - wide-page
modified_at: 2026-07-19
---
```meta-bind-button
style: primary
label: Open Meta Bind Docs
action:
  type: open
  link: https://www.moritzjung.dev/obsidian-meta-bind-plugin-docs/
```

> [!note] 
> Inline buttons must reference a button code block defined elsewhere in the **same note** via matching ids. Unless they are in the plugin settings

# Update a property with change in another property
e.g. [[Transit#1 Pre-Tax Benefits]]
# 1 Progress Bar
```meta-bind
INPUT[progressBar(maxValue(100), minValue(0), stepSize(1), title('title'), addLabels(true)):完成页数]
```


# 2 Toggle
Test: `INPUT[toggle:test]` 
Value: `VIEW[{test}]`
```meta-bind
INPUT[toggle(offValue(in progress), onValue(done)):status]
```
# 3 日期
## 3.1 Date
```meta-bind
INPUT[date()]
```
## 3.2 DatePicker
```meta-bind
INPUT[datePicker()]
```
## 3.3 DateTime
```meta-bind
INPUT[dateTime()]
```
# 4 Text
-  Editor -- text field
## 4.1 Inline list
display items
```meta-bind
INPUT[inlineList()]
```
## 4.2 Select
- Inline
```meta-bind
INPUT[inlineSelect(option('one'), option('two'))]
```
```meta-bind
INPUT[select(option('one'), option('two'))]
```
## 4.3 Multi select
```meta-bind
INPUT[multiSelect(option('one'), option('two'))]
```
# 5 Others
## 5.1 Image list suggester
```meta-bind
INPUT[imageListSuggester()]
```
## 5.2 Number
```meta-bind
INPUT[number()]
```

# Button style
![[Meta Bind-20250804.html]]