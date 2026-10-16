---
tags:
  - 配置
modified_at: 2026-10-16
locations:
  bj:
    name: 北京
    name_en: Beijing
    timezone: Asia/Shanghai
  hd:
    name: 海德堡
    name_en: Heidelberg
    timezone: Europe/Berlin
  wh:
    name: 武汉
    name_en: Wuhan
    timezone: Asia/Shanghai
  pvd:
    name: 普罗维登斯
    name_en: Providence
    timezone: America/New_York
  jc:
    name: 泽西市
    name_en: Jersey City
    timezone: America/New_York
  sf:
    name: 旧金山
    name_en: San Francisco
    timezone: America/Los_Angeles
---

# Daily note 地点映射

`location` 使用缩写；上方 `locations` 是地点名称和 IANA 时区的统一映射。

| location | 地点 | English | IANA timezone |
| --- | --- | --- | --- |
| bj | 北京 | Beijing | Asia/Shanghai |
| hd | 海德堡 | Heidelberg | Europe/Berlin |
| wh | 武汉 | Wuhan | Asia/Shanghai |
| pvd | 普罗维登斯 | Providence | America/New_York |
| jc | 泽西市 | Jersey City | America/New_York |
| sf | 旧金山 | San Francisco | America/Los_Angeles |

## 使用规则

- 覆盖截至 2026-10-16 所有 `日记/` daily notes 中非空的 `location` 值。
- 根据日记日期和 IANA 时区计算当日 UTC 偏移；不要将夏令时缩写或当前偏移作为历史日记的时区。
- 空地点表示未知，不自动填充；遇到新缩写时先补充映射，不静默退回当前所在地或应用默认时区。
- 本文件是配置记录；现有脚本或 PWA 必须显式读取 `locations` 才会使用此映射。本次不改变应用的全局时区。

## 历史居住信息

已确认海德堡居住区间为 **2013-09-01 至 2014-02-21**（含首尾），对应 `hd`。
此信息不自动覆盖旅行期间或其他已有 daily note 的地点属性。
